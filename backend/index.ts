import { router, json, error, secrets } from '@appdeploy/sdk';

type SearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: {
      medium?: { url?: string };
      high?: { url?: string };
      default?: { url?: string };
    };
  };
};
type VideoItem = { id?: string; contentDetails?: { duration?: string } };

function durationSeconds(value: string) {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'GET /api/search': [
    async ({ query }) => {
      const q = (query.q ?? '').trim();
      if (!q) return error('Search query required', 400);
      try {
        const key = await secrets.readSecret('YOUTUBE_API_KEY');
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&maxResults=20&q=${encodeURIComponent(`${q} music -shorts`)}&key=${encodeURIComponent(key)}`;
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok)
          throw new Error(`YouTube search failed: ${searchResponse.status}`);
        const searchData = (await searchResponse.json()) as {
          items?: SearchItem[];
        };
        const ids = (searchData.items ?? [])
          .map(item => item.id?.videoId)
          .filter((id): id is string => Boolean(id));
        if (!ids.length) return json({ songs: [] });
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(ids.join(','))}&key=${encodeURIComponent(key)}`;
        const detailsResponse = await fetch(detailsUrl);
        if (!detailsResponse.ok)
          throw new Error(`YouTube details failed: ${detailsResponse.status}`);
        const detailsData = (await detailsResponse.json()) as {
          items?: VideoItem[];
        };
        const durations = new Map(
          (detailsData.items ?? []).map(item => [
            item.id ?? '',
            durationSeconds(item.contentDetails?.duration ?? ''),
          ])
        );
        const songs = (searchData.items ?? [])
          .map(item => {
            const id = item.id?.videoId ?? '';
            const title = item.snippet?.title ?? '';
            const duration = durations.get(id) ?? 0;
            if (!id || duration < 75 || /#shorts|\bshorts\b/i.test(title))
              return null;
            const thumbnails = item.snippet?.thumbnails;
            return {
              id,
              title,
              channel: item.snippet?.channelTitle ?? '',
              thumbnail:
                thumbnails?.medium?.url ??
                thumbnails?.high?.url ??
                thumbnails?.default?.url ??
                '',
              durationSeconds: duration,
            };
          })
          .filter((song): song is NonNullable<typeof song> => song !== null)
          .slice(0, 14);
        return json({ songs });
      } catch (cause) {
        console.error(
          'Music search failed',
          cause instanceof Error ? cause.message : 'Unknown error'
        );
        return error('Unable to load music right now', 502);
      }
    },
  ],
});
