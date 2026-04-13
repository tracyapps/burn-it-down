/**
 * Podcast RSS feed — Apple Podcasts / Spotify / RSS compatible
 *
 * For Apple Podcasts submission this feed needs:
 * - A publicly accessible audio URL on each episode (audio_url field)
 * - The audio file size in bytes (audio_file_size field)
 * - Show artwork uploaded via the admin (site settings > logo)
 *
 * Submit the feed URL (https://your-domain.com/podcast.xml) to:
 * - Apple Podcasts: podcastsconnect.apple.com
 * - Spotify: podcasters.spotify.com
 * - Other directories: use the feed URL directly
 */

import type { APIRoute } from "astro";
import { getEmDashCollection, getSiteSettings } from "emdash";
import { resolveBlogSiteIdentity } from "../utils/site-identity";

const PODCAST_AUTHOR = "B.U.R.N. It Down";
const PODCAST_EMAIL = "hello@burnitdown.fm"; // Update this
const PODCAST_LANGUAGE = "en-us";
const PODCAST_CATEGORY = "Society &amp; Culture";
const PODCAST_SUBCATEGORY = "Social Justice";
const PODCAST_EXPLICIT = "no"; // Set to "yes" if content is explicit

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

/**
 * Format seconds or HH:MM:SS string to HH:MM:SS for iTunes
 * Accepts: "1:02:14", "58:31", "3600" (seconds), etc.
 */
function formatDuration(duration: string | null | undefined): string {
	if (!duration) return "";
	// If it already looks like HH:MM:SS or MM:SS, return as-is
	if (/^\d+:\d+(:\d+)?$/.test(duration.trim())) return duration.trim();
	// If it's numeric seconds
	const secs = parseInt(duration, 10);
	if (!isNaN(secs)) {
		const h = Math.floor(secs / 3600);
		const m = Math.floor((secs % 3600) / 60);
		const s = secs % 60;
		return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	}
	return duration;
}

export const GET: APIRoute = async ({ site, url }) => {
	const siteUrl = (site?.toString() ?? url.origin).replace(/\/$/, "");
	const settings = await getSiteSettings();
	const { siteTitle, siteTagline, siteLogo } = resolveBlogSiteIdentity(settings);

	const showArtworkUrl = siteLogo?.url
		? siteLogo.url.startsWith("http")
			? siteLogo.url
			: `${siteUrl}${siteLogo.url}`
		: `${siteUrl}/podcast-cover.jpg`; // Fallback — upload your artwork

	const { entries: episodes } = await getEmDashCollection("episodes", {
		orderBy: { published_at: "desc" },
		limit: 100,
	});

	const publishedEps = episodes.filter(
		(ep) => ep.data.publishedAt && ep.data.audio_url
	);

	const items = publishedEps
		.map((ep) => {
			const epUrl = `${siteUrl}/episodes/${ep.id}`;
			const title = escapeXml(ep.data.title ?? "Untitled");
			const description = escapeXml(ep.data.excerpt ?? "");
			const pubDate = ep.data.publishedAt!.toUTCString();
			const duration = formatDuration(ep.data.audio_duration);
			const audioUrl = ep.data.audio_url ?? "";
			const fileSize = ep.data.audio_file_size ?? 0;

			// Episode artwork
			const epArt = (() => {
				const img = ep.data.cover_art as Record<string, unknown> | null | undefined;
				if (!img) return null;
				if (typeof img.src === "string" && img.src) {
					return img.src.startsWith("http") ? img.src : `${siteUrl}${img.src}`;
				}
				const meta = img.meta as Record<string, unknown> | undefined;
				const key =
					(typeof meta?.storageKey === "string" ? meta.storageKey : undefined) ||
					(typeof img.id === "string" ? img.id : undefined);
				if (key) return `${siteUrl}/_emdash/api/media/file/${key}`;
				return null;
			})();

			const episodeNum = ep.data.episode_number;
			const seasonNum = ep.data.season_number;

			return `    <item>
      <title>${title}</title>
      <link>${epUrl}</link>
      <guid isPermaLink="true">${epUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <itunes:summary>${description}</itunes:summary>
      <enclosure url="${escapeXml(audioUrl)}" length="${fileSize}" type="audio/mpeg"/>
      <itunes:author>${escapeXml(PODCAST_AUTHOR)}</itunes:author>
      <itunes:explicit>${PODCAST_EXPLICIT}</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>${duration ? `\n      <itunes:duration>${escapeXml(duration)}</itunes:duration>` : ""}${episodeNum != null ? `\n      <itunes:episode>${episodeNum}</itunes:episode>` : ""}${seasonNum != null ? `\n      <itunes:season>${seasonNum}</itunes:season>` : ""}${epArt ? `\n      <itunes:image href="${escapeXml(epArt)}"/>` : ""}
    </item>`;
		})
		.join("\n");

	const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(siteTagline)}</description>
    <language>${PODCAST_LANGUAGE}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/podcast.xml" rel="self" type="application/rss+xml"/>
    <itunes:author>${escapeXml(PODCAST_AUTHOR)}</itunes:author>
    <itunes:summary>${escapeXml(siteTagline)}</itunes:summary>
    <itunes:image href="${escapeXml(showArtworkUrl)}"/>
    <itunes:category text="${PODCAST_CATEGORY}">
      <itunes:category text="${PODCAST_SUBCATEGORY}"/>
    </itunes:category>
    <itunes:explicit>${PODCAST_EXPLICIT}</itunes:explicit>
    <itunes:owner>
      <itunes:name>${escapeXml(PODCAST_AUTHOR)}</itunes:name>
      <itunes:email>${escapeXml(PODCAST_EMAIL)}</itunes:email>
    </itunes:owner>
    <itunes:type>episodic</itunes:type>
    <image>
      <url>${escapeXml(showArtworkUrl)}</url>
      <title>${escapeXml(siteTitle)}</title>
      <link>${siteUrl}</link>
    </image>
${items}
  </channel>
</rss>`;

	return new Response(feed, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
