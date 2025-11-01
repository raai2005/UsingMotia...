// ====================== IMPORTS ======================
import { ApiRouteConfig, Handler } from "motia";


// ====================== CONFIG ======================
/**
 * API route config
 * Accepts channel + email → starts workflow
 */
export const config: ApiRouteConfig = {
    name: "SubmitChannel",
    type: "api",
    path: "/submit",
    method: "POST",
    emits: ["yt.submit"],
};


// ====================== TYPES ======================
interface SubmitRequest {
    channel: string;
    email: string;
}


// ====================== HANDLER ======================
/**
 * Handles POST /submit
 * 1) Validates payload
 * 2) Creates job state
 * 3) Emits workflow event
 */
export const handler = async (req: any, { emit, logger, state }: any) => {
    try {
        // ---------- LOG REQUEST ----------
        logger.info("Received submission request", { body: req.body });

        // ---------- EXTRACT BODY ----------
        const { channel, email } = req.body as SubmitRequest;

        // ---------- VALIDATE REQUIRED FIELDS ----------
        if (!channel || !email) {
            return {
                status: 400,
                body: {
                    error: "Channel and email are required",
                },
            };
        }

        // ---------- VALIDATE EMAIL FORMAT ----------
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return {
                status: 400,
                body: {
                    error: "Invalid email format",
                },
            };
        }

        // ---------- CREATE UNIQUE JOB ID ----------
        const jobID = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // ---------- SAVE STATE ----------
        await state.set(`job:${jobID}`, {
            jobID,
            channel,
            email,
            status: "queued",
            createdAt: new Date().toISOString(),
        });

        logger.info("Job created", { jobID, channel, email });

        // ---------- EMIT WORKFLOW EVENT ----------
        await emit({
            topic: "yt.submit",
            data: {
                jobID,
                channel,
                email,
            },
        });

        // ---------- SUCCESS RESPONSE ----------
        return {
            status: 201,
            body: {
                success: true,
                jobID,
                message: "Job submitted successfully. You will get an email soon.",
            },
        };

    } catch (error: any) {
        // ---------- ERROR HANDLING ----------
        logger.error("Error in Submission handler:", { error: error.message });

        return {
            status: 500,
            body: {
                error: "Internal Server Error",
            },
        };
    }
};
