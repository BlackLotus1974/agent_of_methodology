"use client";
import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";

const App = dynamic(() => import("./App"), { ssr: false });

export default function ClientPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TranscriptProvider>
        <EventProvider>
          <App />
        </EventProvider>
      </TranscriptProvider>
    </Suspense>
  );
}


