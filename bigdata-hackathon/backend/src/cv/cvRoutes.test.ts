import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import test from "node:test";
import express from "express";
import { createCvRouter } from "./cvRoutes";

const sampleCv = {
  fullName: "Aline Example",
  email: "aline@example.com",
  phone: "+250700000000",
  location: "Kigali",
  summary: "Early-career data analyst with experience in Excel.",
  objective: "",
  education: [{ qualification: "BSc Statistics", institution: "Example University", dates: "2021–2024", details: "" }],
  experience: [{
    position: "Intern",
    organization: "Example Office",
    dates: "2023",
    responsibilities: "Prepared weekly reports",
    achievements: "Reduced manual entry",
  }],
  projects: [],
  skills: ["Excel", "Data analysis"],
  certifications: [],
  languages: [{ name: "Kinyarwanda", proficiency: "Fluent" }],
  achievements: [],
  volunteering: "",
};

async function withServer(callback: (baseUrl: string) => Promise<void>): Promise<void> {
  const application = express();
  application.use(express.json({ limit: "100kb" }));
  application.use("/api/v1/cv", createCvRouter());
  const server = application.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("CV improvement without AI configuration retains the user's original content", async () => {
  const previousKey = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/cv/improve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cv: sampleCv, language: "en" }),
      });
      const body = await response.json() as { success: boolean; data: { cv: typeof sampleCv; aiEnhanced: boolean; message: string } };
      assert.equal(response.status, 200);
      assert.equal(body.success, true);
      assert.equal(body.data.aiEnhanced, false);
      assert.deepEqual(body.data.cv, sampleCv);
      assert.match(body.data.message, /not configured/);
    });
  } finally {
    if (previousKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previousKey;
  }
});

test("DOCX endpoint returns a genuine Word archive", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/cv/docx`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cv: sampleCv, language: "en" }),
    });
    const document = new Uint8Array(await response.arrayBuffer());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.match(response.headers.get("content-disposition") ?? "", /\.docx/);
    assert.equal(document[0], 0x50);
    assert.equal(document[1], 0x4b);
  });
});

test("CV endpoints reject missing contact details and unsupported languages", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/cv/docx`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cv: { ...sampleCv, email: "", phone: "" }, language: "de" }),
    });
    const body = await response.json() as { success: boolean; error: { code: string } };
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.error.code, "INVALID_CV");
  });
});
