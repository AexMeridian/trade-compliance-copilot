-- Lead image for a news item, exactly as the source feed publishes it (BBC
-- media:thumbnail, Guardian media:content). Only the URL is stored: the
-- browser loads the image straight from the publisher, with the headline
-- linking back to the article. NULL when the feed supplies none.
ALTER TABLE world_news ADD COLUMN image_url TEXT;
