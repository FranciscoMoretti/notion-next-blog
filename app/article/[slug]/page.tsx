// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck 
import { Fragment } from 'react';
import Head from 'next/head';
import Link from 'next/link';

import {
  getDatabase, getBlocks, getPageFromSlug,
} from '../../../lib/notion';
import Text from '../../../components/text';
import { renderBlock } from '../../../components/notion/renderer';
import styles from '../../../styles/post.module.css';
import { slugToPlainText } from '@/lib/slugToPlainText';

// Return a list of `params` to populate the [slug] dynamic segment
export async function generateStaticParams() {
  const database = await getDatabase();
  return database?.map((page) => {
    const slug = slugToPlainText(page);
    return ({ id: page.id, slug });
  });
}

// @ts-expect-error params not defined yet
export default async function Page({ params }) {
  const page = await getPageFromSlug(params?.slug);
  // @ts-expect-error Argument of type 'string | undefined' is not assignable to parameter of type 'string'
  const blocks = await getBlocks(page?.id);

  if (!page || !blocks) {
    return <div>Not found</div>;
  }

  return (
    <div>
      <Head>
        {/* @ts-expect-error Property 'title' does not exist on type */}
        <title>{page.properties.Title?.title[0].plain_text}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <article className={styles.container}>
        <h1 className={styles.name}>
          {/* @ts-expect-error Property 'title' does not exist on type */}
          <Text title={page.properties.Title?.title} />
        </h1>
        <section>
          {blocks.map((block) => (
            <Fragment key={block.id}>{renderBlock(block)}</Fragment>
          ))}
          <Link href="/" className={styles.back}>
            ← Go home
          </Link>
        </section>
      </article>
    </div>
  );
}

// export const getStaticPaths = async () => {
//   const database = await getDatabase(databaseId);
//   return {
//     paths: database.map((page) => {
//       const slug = page.properties.Slug?.formula?.string;
//       return ({ params: { id: page.id, slug } });
//     }),
//     fallback: true,
//   };
// };

