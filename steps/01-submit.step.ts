import {ApiRouteConfig, Handler} from "motia"

// accepting channel name and email(the data) to start the workflow
export const config : ApiRouteConfig = {
    name: "SubmitChannel",
    type: "api",
    path: "/submit",
    method: "POST",
    emits: ["yt.submit"],
};

interface SubmitRequest {
    channel: string;
    email: string;
}

// after getting the data
export const handler = async (req: any, {emit, logger, state}: any) => {
    try {
        logger.info("Received submission request", {body: req.body});
        const {channel, email} = req.body as SubmitRequest;

        if(!channel || !email) {
            return {
                status: 400,
                body: {
                    error: "Channel and email are required"
                },
            };
        }

        // validate the email format
        const eamilRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if(!eamilRegex.test(email)) {
            return {
                status: 400,
                body: {
                    error: "Invalid email format"
                },
            };
        }

        // unique job id for each submission
        const jobID = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // created state for the job
        await state.set(`job: ${jobID}`, {
            jobID,
            channel,
            email,
            status: "queued",
            createdAt: new Date().toISOString()
        })
        logger.info("Job created", {jobID, channel, email});

        // emitting the event
        await emit({
            topic: "yt.submit",
            data: {
                jobID,
                channel,
                email
            }
        });
        return {
            status: 201,
            body: {
                success: true,
                jobID,
                message: "Job submitted successfully. You will get an email soon."
            },
        };


    } catch(error: any) {
        logger.error("Error in Submission handler:", {error: error.message});
        return {
            status: 500,
            body: {
                error: "Internal Server Error"
            },
        };
    }
}