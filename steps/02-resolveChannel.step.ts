// ✅ Import dependencies
import {EventConfig} from "motia";

// ✅ Step 1: Event configuration
export const config: EventConfig = {
    name: "ResolveChannel",
    type: "event",
    subscribes: ["yt.submit"],
    emits: ["yt.channel.resolved", "yt.channel.error"],
};

// ✅ Step 2: Event handler
export const handler = async (eventData: any, {emit, logger, state}: any) => {
    let jobID: string | undefined;
    let email: string | undefined;

    try {
        // ✅ Parse event payload
        const data = eventData || {}
        jobID = data.jobID;
        email = data.email;
        const channel = data.channel;

        logger.info("Resolving yt channel", {jobID, channel})

        // ✅ Validate API key
        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
        if(!YOUTUBE_API_KEY){
            throw new Error("YOUTUBE_API_KEY is not set in environment variables")
        }

        // ✅ Update job state → resolving channel
        const jobData = await state.get(`job: ${jobID}`)
        await state.set(`job: ${jobID}`, {
            ...jobData,
            status: "resolving channel"
        });

        let channelID: string | null = null
        let channelName: string = ""

        // ✅ Step 3: Resolve handle (e.g. @channel)
        if(channel.startsWith('@')) {
            const handle = channel.substring(1)

            // ✅ Search channel by handle
            const searchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&key=${YOUTUBE_API_KEY}`;

            const searchResponse = await fetch(searchURL)
            const searchData = await searchResponse.json()
            
            if(searchData.items && searchData.items.length>0) {
                channelID = searchData.items[0].id.channelId;
                channelName = searchData.items[0].snippet.title;

            } else {
                // ✅ Fallback search using raw text
                const searchURL = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(channel)}&key=${YOUTUBE_API_KEY}`;
                const searchResponse = await fetch(searchURL)
                const searchData = await searchResponse.json()
            }
            
        }

        // ✅ Step 4: Handle channel not found
        if(!channelID) {
            logger.error("channel not found", {channel});
            await state.set(`job: ${jobID}`, {
                ...jobData,
                status: "failed",
                error: "Channel not found"
            })
            await emit({
                topic: "yt.channel.error",
                data: {
                    jobID,
                    email,
                },
            });
            return;
        }
        
        // ✅ Step 5: Emit resolved event
        await emit({
            topic: "yt.channel.resolved",
            data: {
                jobID,
                channelID,
                channelName,
                email,
            },
        });
        return;

    } catch (error: any) {
        // ✅ Step 6: Handle unexpected errors
        logger.error("Error resolving channel", {error: error.message})
        if(!jobID || !email){
            logger.error("JobID or Email is required")
            return
        }

        const jobData = await state.get(`job: ${jobID}`)

        await state.set(`job: ${jobID}`, {
            ...jobData,
            status: "failed",
            error: error.message
        })

        await emit({
            topic: "yt.channel.error",
            data: {
                jobID,
                email,
                error: "Failed to resolve channel: " + error.message
            },
        });
    }
}
