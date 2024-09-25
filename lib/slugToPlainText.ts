import { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

export function slugToPlainText(page: PageObjectResponse): string | false {
  return page.properties.Slug &&
    'rich_text' in page.properties.Slug &&
    page.properties.Slug.rich_text[0]?.plain_text;
}
