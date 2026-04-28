import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  const isProd = import.meta.env.PROD;
  const all = await getCollection("blog", ({ data }) => (isProd ? !data.draft : true));
  const posts = all.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: "Pedro Mansan — Writing",
    description: "Notes on multi-tenant SaaS, Django internals, authorization, and AI-assisted refactors at scale.",
    site: context.site ?? "https://pedro.mansan.dev",
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/writing/${post.id}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
