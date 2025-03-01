import { getTimedFilename } from "./utils.js";

export const getIGVideoFileName = () =>
    getTimedFilename("ig-downloader", "mp4");

export const handleScraperError = (error) => {
    console.log("Scraper error:", error.message);
    if (error.message.includes("status code 404")) {
        throw new Error("Esta postagem é privada ou não existe.", 404);
    } else if (error) {
        throw new Error();
    }
};