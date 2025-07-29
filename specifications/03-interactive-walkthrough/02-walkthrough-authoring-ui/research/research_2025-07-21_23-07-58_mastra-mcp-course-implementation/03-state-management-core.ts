// State Management - Core Functions
// Extracted from: packages/mcp-docs-server/src/tools/course.ts

import { existsSync, mkdirSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CourseState, DeviceCredentials } from "./01-course-types-and-interfaces.js";

// Device credential management
export async function getDeviceIdPath(): Promise<string> {
  const cacheDir = path.join(os.homedir(), ".cache", "mastra");
  
  // Create the directory if it doesn't exist
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }
  
  return path.join(cacheDir, ".device_id");
}

export async function getDeviceCredentials(): Promise<DeviceCredentials> {
  try {
    const deviceIdPath = await getDeviceIdPath();
    if (!existsSync(deviceIdPath)) {
      return null;
    }
    const fileContent = await fs.readFile(deviceIdPath, "utf-8");
    const parsed = JSON.parse(fileContent);
    if (typeof parsed.deviceId === "string" && typeof parsed.key === "string") {
      return { deviceId: parsed.deviceId, key: parsed.key };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveDeviceCredentials(
  deviceId: string,
  key: string,
): Promise<void> {
  const deviceIdPath = await getDeviceIdPath();
  const toWrite = JSON.stringify({ deviceId, key });
  await fs.writeFile(deviceIdPath, toWrite, "utf-8");
  // Set file permissions to 600 (read/write for owner only)
  await fs.chmod(deviceIdPath, 0o600);
}

// Course state file management
export async function getCourseStatePath(): Promise<string> {
  const stateDirPath = path.join(os.homedir(), ".cache", "mastra", "course");
  
  // Ensure the directory exists
  if (!existsSync(stateDirPath)) {
    mkdirSync(stateDirPath, { recursive: true });
  }
  
  return path.join(stateDirPath, "state.json");
}

export async function loadCourseState(): Promise<CourseState | null> {
  const statePath = await getCourseStatePath();
  
  try {
    if (existsSync(statePath)) {
      const stateData = await fs.readFile(statePath, "utf-8");
      return JSON.parse(stateData) as CourseState;
    }
  } catch (error) {
    throw new Error(`Failed to load course state: ${error}`);
  }
  
  return null;
}

export async function saveCourseState(
  state: CourseState,
  deviceId: string | null,
): Promise<void> {
  // If no device ID, the user isn't registered - this is an error condition
  if (!deviceId) {
    throw new Error("Cannot save course state: User is not registered");
  }
  
  const statePath = await getCourseStatePath();
  try {
    // Save to local filesystem
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
    
    // Sync with server
    try {
      // Use getDeviceCredentials to ensure we have the key
      const creds = await getDeviceCredentials();
      if (!creds) throw new Error("Device credentials not found");
      await updateCourseStateOnServer(creds.deviceId, state);
    } catch {
      // Silently continue if server sync fails
      // Local save is still successful
    }
  } catch (error) {
    throw new Error(`Failed to save course state: ${error}`);
  }
}