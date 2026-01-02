import { createTransport } from "nodemailer";
import { html, text } from "../lib/utils/email.js";
import { AuthError } from "../errors.js";
export default function Nodemailer(config) {
    if (!config.server)
        throw new AuthError("Nodemailer requires a `server` configuration");
    return {
        id: "nodemailer",
        type: "email",
        name: "Nodemailer",
        server: { host: "localhost", port: 25, auth: { user: "", pass: "" } },
        from: "Auth.js <no-reply@authjs.dev>",
        maxAge: 24 * 60 * 60,
        async sendVerificationRequest(params) {
            const { identifier, url, provider, theme } = params;
            const { host } = new URL(url);
            const transport = createTransport(provider.server);
            const result = await transport.sendMail({
                to: identifier,
                from: provider.from,
                subject: `Sign in to ${host}`,
                text: text({ url, host }),
                html: html({ url, host, theme }),
            });
            const failed = result.rejected.concat(result.pending).filter(Boolean);
            if (failed.length) {
                throw new Error(`Email (${failed.join(", ")}) could not be sent`);
            }
        },
        options: config,
    };
}
