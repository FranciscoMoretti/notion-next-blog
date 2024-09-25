import { NextResponse } from 'next/server';
import { getDatabase, getDatabaseQuery, updateDatabaseCache } from '@/lib/notion';
import { revalidateTag } from 'next/cache';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';

type PageObjectsMap = Record<string, PageObjectResponse>;

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Read from previous database_cache
    console.log('Revalidating cache');
    const cachedData = await getDatabase();
    const freshData = await getDatabaseQuery();

    // Compare cached data with fresh data
    if (JSON.stringify(cachedData) !== JSON.stringify(freshData)) {
      // Data has changed, update the cache
      console.log(`Revalidating [notion_database]`);

      revalidateTag('notion_database');


      // Create a map of the fresh data
      const cachedDataMap = toDataMap(cachedData);
      const freshDataMap = toDataMap(freshData);

      const pagesToRevalidate = getPagesToRevalidate(cachedDataMap, freshDataMap);
      console.log(`Revalidating ${pagesToRevalidate.length} pages`);
      // Revalidate the pages
      for (const page of pagesToRevalidate) {
        console.log(`Revalidating [notion_blocks_${page.id}]`);
        revalidateTag(`notion_blocks_${page.id}`);
      }

    //  Update the cache with the new data
    await updateDatabaseCache(freshData);

      return new Response('Cache updated with new data', { status: 200 });
    } else {
      return new Response('No changes detected, cache remains the same', { status: 200 });
    }
  } catch (error) {
    console.error('Error in cache route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

function toDataMap(cachedData: PageObjectResponse[]) {
    return cachedData.reduce<PageObjectsMap>((acc, page) => {
        acc[page.id] = page;
        return acc;
    }, {});
}


function getPagesToRevalidate(prevPages :PageObjectsMap, newPages: PageObjectsMap): PageObjectResponse[] {
    const idsToRevalidate = Object.keys(newPages).filter(pageId => {
        const prevPage = prevPages[pageId];
        const newPage = newPages[pageId];
        return prevPage && (prevPage.last_edited_time !== newPage.last_edited_time)
    });
    return idsToRevalidate.map(id => newPages[id]);
}
