// API Communication Patterns
// Extracted from: packages/mcp-docs-server/src/tools/course.ts

import http from "node:http";
import { CourseState, RegistrationResponse, DeviceCredentials } from "./01-course-types-and-interfaces.js";

// User registration - Production API
export async function registerUser(email: string): Promise<RegistrationResponse> {
  const response = await fetch("https://mastra.ai/api/course/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(
      `Registration failed with status ${response.status}: ${response.statusText}`,
    );
  }

  return response.json();
}

// User registration - Local development API
export function registerUserLocally(email: string): Promise<RegistrationResponse> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email });
    const options = {
      hostname: "localhost",
      port: 3000,
      path: "/api/course/register",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };
    
    const req = http.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error}`));
        }
      });
    });
    
    req.on("error", (error) => {
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

// Course state sync - Production API
export async function updateCourseStateOnServer(
  deviceId: string,
  state: CourseState,
): Promise<void> {
  const creds = await getDeviceCredentials();
  if (!creds) {
    throw new Error("Device credentials not found.");
  }

  const response = await fetch("https://mastra.ai/api/course/update", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mastra-course-key": creds.key, // Authentication header
    },
    body: JSON.stringify({
      id: creds.deviceId,
      state: state,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Course state update failed with status ${response.status}: ${response.statusText}`,
    );
  }
}

// Course state sync - Local development API  
export function updateCourseStateOnServerLocally(
  deviceId: string,
  state: CourseState,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const creds = await getDeviceCredentials();
      if (!creds) {
        return reject(new Error("Device credentials not found."));
      }
      
      const data = JSON.stringify({
        id: creds.deviceId,
        state: state,
      });
      
      const options = {
        hostname: "localhost",
        port: 3000,
        path: "/api/course/update",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
          "x-mastra-course-key": creds.key, // Authentication header
        },
      };
      
      const req = http.request(options, (res) => {
        let responseData = "";
        res.on("data", (chunk) => {
          responseData += chunk;
        });
        res.on("end", () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve();
            } else {
              reject(new Error(`Server returned status code ${res.statusCode}: ${responseData}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        });
      });
      
      req.on("error", (error) => {
        reject(error);
      });
      
      req.write(data);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

// API Endpoints Summary:
// Production:
// - POST https://mastra.ai/api/course/register
//   Body: { email: string }
//   Response: { success: boolean, id: string, key: string, message: string }
//
// - POST https://mastra.ai/api/course/update  
//   Headers: { "x-mastra-course-key": string }
//   Body: { id: string, state: CourseState }
//   Response: 200 OK
//
// Development (localhost:3000):
// - Same endpoints, same format