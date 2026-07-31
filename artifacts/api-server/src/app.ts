import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { ApiError } from "./lib/http-errors";
import { logger } from "./lib/logger";
import { corsOptions } from "./lib/security";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// JSON API with no cookies or embedded content, so the restrictive defaults
// helmet applies to HTML responses are not in the way here.
app.use(helmet());
app.use(cors(corsOptions));

// Scraping and Sheets routes are the expensive ones; this bounds how fast a
// single caller can drive them. Generous enough that normal app use never sees it.
app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "rate_limited",
      message: "Too many requests. Please try again in a moment.",
    },
  }),
);

app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

app.use("/api", router);

app.use((req, res) => {
  res.status(404).json({ error: "not_found", message: "No such endpoint." });
});

/**
 * Terminal error handler. Without this, `next(err)` reaches Express's default
 * handler, which replies with an HTML page containing the stack trace and
 * absolute file paths. Everything leaving here is a shaped JSON envelope; the
 * detail stays in the server log.
 */
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  if (err instanceof ApiError) {
    req.log?.warn({ err, code: err.code }, "Handled API error");
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }

  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({
    error: "internal_error",
    message: "Something went wrong on our end. Please try again.",
  });
});

export default app;
