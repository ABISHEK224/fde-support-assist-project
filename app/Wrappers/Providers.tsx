"use client";
import {
  QueryClient,
  QueryClientProvider as RQQueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

let browserQueryClient: QueryClient | undefined = undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

const getQueryClient = () => {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
};

export const QueryClientProvider = ({ children }: React.PropsWithChildren) => {
  const queryClient = getQueryClient();

  return (
    <RQQueryClientProvider client={queryClient}>
      {children}
    </RQQueryClientProvider>
  );
};
