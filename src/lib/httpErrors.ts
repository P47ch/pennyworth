export type ErrorPageModel = {
  statusCode: number;
  title: string;
  heading: string;
  message: string;
  requestId: string;
};

function safeStatusCode(error: unknown): number {
  if (!error || typeof error !== "object") {
    return 500;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" && Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
    ? statusCode
    : 500;
}

export function errorPageModel(error: unknown, requestId: string): ErrorPageModel {
  const statusCode = safeStatusCode(error);

  if (statusCode === 404) {
    return {
      statusCode,
      title: "Page not found",
      heading: "Page not found",
      message: "The page you requested does not exist.",
      requestId
    };
  }

  if (statusCode === 429) {
    return {
      statusCode,
      title: "Too many requests",
      heading: "Please slow down",
      message: "Too many requests were received. Wait a moment and try again.",
      requestId
    };
  }

  if (statusCode < 500) {
    return {
      statusCode,
      title: "Request error",
      heading: "The request could not be completed",
      message: "Check the request and try again.",
      requestId
    };
  }

  return {
    statusCode: 500,
    title: "Application error",
    heading: "Something went wrong",
    message: "Pennyworth could not complete the request. Try again in a moment.",
    requestId
  };
}
