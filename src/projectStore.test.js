import { describe, expect, it } from "vitest";
import { createProjectBackup, parseProjectBackup } from "./projectStore.js";

describe("project backup", () => {
  it("round-trips project versions and teacher edits", () => {
    const projects = [{
      id: "project-1",
      title: "椭圆动点",
      chapter: "圆锥曲线",
      tags: ["高三", "动点"],
      versions: [{ id: "v1", result: { schemaVersion: 2, ggbCommands: ["A=(0,0)"] } }]
    }];
    expect(parseProjectBackup(createProjectBackup(projects))).toEqual(projects);
  });

  it("rejects unrelated json files", () => {
    expect(() => parseProjectBackup('{"projects":[]}')).toThrow("不是有效的 GeoGebra AI 项目备份");
  });
});
