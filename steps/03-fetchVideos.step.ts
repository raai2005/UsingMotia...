// ==========================
// COMPONENT 1: Event Configuration
// Purpose: Defines event metadata & subscription rules
// ==========================
// Module: FetchedVideos Event
// Description: Fetches latest YouTube videos based on resolved channel ID
// ==========================
import {EventConfig} from "motia";

// step3: fetching latest videos from resolved channel id using yt data api key

export const config: EventConfig = {
    name: "FetchedVideos",            // Event name identifier
    type: "event",                    // Type of module: event
    subscribes: ["yt.channel.resolved"], // Listens for resolved channel event
    emits: ["yt.videos.fetched", "yt.videos.error"], // Emits events after fetching videos or if error occurs
};

// Interface for storing required video properties
// ==========================
// COMPONENT 2: Video Interface
// Purpose: Defines structure of video objects fetched from YouTube API
// ==========================
interface Video {
    videoID: string;      // Unique YouTube video ID
    title: string;        // Title of the video
    url: string;          // YouTube video URL
    publishedAt: string;  // Video publish timestamp
    thumbnail: string;    // URL of the thumbnail image
}

// Main event handler for fetching videos
// ==========================
// COMPONENT 3: Handler Function
// Purpose: Main workflow to fetch & process YouTube videos
// ==========================
// Handler: Fetch YouTube Videos
// Triggered when channel is resolved; fetches videos & updates job state
// ==========================
export const handler = async (eventData: any, {emit, logger, state}: any) => {
    let jobID: string | undefined;   // Stores job identifier
    let email: string | undefined;   // Stores user email

    try{
        // --- Step 1: Extract and validate input data
        const data = eventData || {}   // Incoming event payload
        jobID = data.jobID;
        email = data.email;
        const channelID = data.channelID;     // Resolved YouTube channel ID
        const channelName = data.channelName; // Original channel name/handle

        logger.info("Fetching videos from yt channel", {jobID, channelID})

        // --- Step 2: Validate API Key
        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY; // Fetching API key from env
        if(!YOUTUBE_API_KEY){
            throw new Error("YOUTUBE_API_KEY is not set in environment variables")
        }

        // --- Step 3: Update job status to 'fetching'
        const jobData = await state.get(`job: ${jobID}`)         // Retrieve job metadata from store
        // --- Step 7: Update job status to 'videos fetched'
        await state.set(`job: ${jobID}`, {
            ...jobData,
            status: "fetching videos"    // Update job status
        });

        // YouTube Data API search endpoint
        // --- Step 4: Build YouTube API request
        const searchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(channelID)}&maxResults=5&order=date&type=video&key=${YOUTUBE_API_KEY}`;
        const response = await fetch(searchURL)  // API request
        const ytData = await response.json()     // Convert response to JSON

        // If no video is found
        // --- Step 5: Handle case when no videos found
        if(!ytData.items || ytData.items.length===0){
            logger.warn("No videos found for channel", {jobID, channelID})

            await state.set(`job: ${jobID}`, {
                ...jobData,
                status: "failed",
                error: "no videos found"    // Update job status with failure
            });
            await emit({
                topic: "yt.videos.error",    // Emit error event
                data: {
                    jobID,
                    email,
                    error: "No videos found for channel"
                },
            });
            return;
        }

        // Mapping raw YouTube API response to defined Video format
        // --- Step 6: Transform API response into Video[] format
        const videos: Video[] = ytData.items.map((item: any) => ({
            videoID: item.id.videoId,
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            publishedAt: item.snippet.publishedAt,
            thumbnail: item.snippet.thumbnails.default.url
        }));

        logger.info("Fetched videos", {
            jobID, 
            videoCount: videos.length   // Logging fetched video count
        })

        await state.set(`job: ${jobID}`, {
            ...jobData,
            status: "videos fetched",  // Update job status
            videos,
        });
        await emit({
            topic: "yt.videos.fetched",   // Emit success event
            data: {
                jobID,
                videos,
                channelName,
                email,
            },
        });

    } catch (error: any) {
        logger.error("Error fetching videos", {error: error.message})  // Log error

        if(!jobID || !email){            // Validate identifiers for proper failure handling
            logger.error("JobID or Email is required")
            return
        }

        const jobData = await state.get(`job: ${jobID}`)

        await state.set(`job: ${jobID}`, {
            ...jobData,
            status: "failed",          // Update state on failure
            error: error.message
        })

        await emit({
            topic: "yt.videos.error",     // Emit failure event
            data: {
                jobID,
                email,
                error: "Failed to fetch videos: " + error.message
            },
        });
    }
}
