import { NextResponse } from "next/server";
import { AppError, toAppError } from "./errors";
import { captureError } from "./observability";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(err: unknown) {
  const appError = toAppError(err);
  captureError(err, { area: "api_route" });
  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.userMessage,
      },
    },
    { status: appError.status }
  );
}

export async function handleApi<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return apiSuccess(data);
  } catch (err) {
    return apiError(err);
  }
}
