// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck 
import { Client } from "@notionhq/client";
import { unstable_cache } from "next/cache";
// TODO: Investigate how to use react cache
// import { cache } from "react";
import { PageObjectResponse, BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { slugToPlainText } from "./slugToPlainText";

export const revalidate = 3600; // revalidate the data at most every hour

const databaseId = process.env.NOTION_DATABASE_ID as string;

/**
 * Returns a random integer between the specified values, inclusive.
 * The value is no lower than `min`, and is less than or equal to `max`.
 *
 * @param {number} minimum - The smallest integer value that can be returned, inclusive.
 * @param {number} maximum - The largest integer value that can be returned, inclusive.
 * @returns {number} - A random integer between `min` and `max`, inclusive.
 */
function getRandomInt(minimum: number, maximum: number): number {
  const min = Math.ceil(minimum);
  const max = Math.floor(maximum);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export const getDatabaseQuery = async (): Promise<PageObjectResponse[]> => {
  const response = await notion.databases.query({
    database_id: databaseId,
  });
  return response.results as PageObjectResponse[];
};

export const getDatabase = unstable_cache(
  () => {
    console.log("Refreshing with query");
    return getDatabaseQuery()},
  ["notion_database"],
  { tags: ["notion_database"], revalidate: 3600 }
);

export const getPageFromSlug = async (slug: string): Promise<PageObjectResponse | undefined> => {
  const databaseChildren = await getDatabase();
  const page = databaseChildren.find(page => 
    slugToPlainText(page) === slug
  );
  return page;
};

type ExpandedBlockObjectResponse = BlockObjectResponse & {
  children?: ExpandedBlockObjectResponse[];
  type: "bulleted_list" | "numbered_list" | BlockObjectResponse["type"];
  bulleted_list?: { children: ExpandedBlockObjectResponse[] };
  numbered_list?: { children: ExpandedBlockObjectResponse[] };
};


async function getNotionBlocks (blockID: string): Promise<ExpandedBlockObjectResponse[]> {
  const blockId = blockID.replaceAll("-", "");

  const { results } = await notion.blocks.children.list({
    block_id: blockId,
    page_size: 100,
  }) as {results: BlockObjectResponse[]};

  // TODO: Use error handling to check if isFullBlock and report

  const childBlocks = results.map(async (block: BlockObjectResponse) => {
    if (block.has_children) {
      const children = await getNotionBlocks(block.id);
      return { ...block, children } as ExpandedBlockObjectResponse;
    }
    return block as ExpandedBlockObjectResponse;
  });

  return Promise.all(childBlocks ).then((blocks) =>
    blocks.reduce((acc: ExpandedBlockObjectResponse[], curr) => {
      if (curr.type === "bulleted_list_item") {
        const lastItem = acc[acc.length - 1];
        if (lastItem && lastItem.type === "bulleted_list") {
          (lastItem.bulleted_list as { children: ExpandedBlockObjectResponse[] }).children.push(curr);
        } else {
          acc.push({
            id: getRandomInt(10 ** 99, 10 ** 100).toString(),
            type: "bulleted_list",
            bulleted_list: { children: [curr] },
          } as ExpandedBlockObjectResponse);
        }
      } else if (curr.type === "numbered_list_item") {
        const lastItem = acc[acc.length - 1];
        if (lastItem && lastItem.type === "numbered_list") {
          (lastItem.numbered_list as { children: ExpandedBlockObjectResponse[] }).children.push(curr);
        } else {
          acc.push({
            id: getRandomInt(10 ** 99, 10 ** 100).toString(),
            type: "numbered_list",
            numbered_list: { children: [curr] },
          } as ExpandedBlockObjectResponse);
        }
      } else {
        acc.push(curr);
      }
      return acc;
    }, [])
  );
}


export async function getBlocks(blockID: string) {
  const cachedBlocks = unstable_cache(
  (blockID: string) => getNotionBlocks(blockID),
  [`notion_blocks_${blockID}`],
  { tags: [`notion_blocks_${blockID}`], revalidate: 3600 }
);
return cachedBlocks(blockID);}

function getDatabaseUpdater(freshData: PageObjectResponse[]) {
    return unstable_cache(
        async () => {
            console.log("Refreshing with updater function");
            return freshData;
        },
        ["notion_database"],
        { tags: ["notion_database"], revalidate: 3600 }
    );
}
export async function updateDatabaseCache(freshData: PageObjectResponse[]) {
    const updateDatabase = getDatabaseUpdater(freshData);
    await updateDatabase();
}

