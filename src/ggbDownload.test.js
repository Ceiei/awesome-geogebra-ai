import { describe, expect, it, vi } from "vitest";
import { createGgbFilename, createGgbWebFilename, createGgbWebPage, getGgbBase64 } from "./ggbDownload.js";

describe("GeoGebra download helpers", () => {
  it("reads and normalizes a GeoGebra base64 export", () => {
    const api = { getBase64: vi.fn(() => "data:application/vnd.geogebra.file;base64, AQID\n") };

    expect(getGgbBase64(api)).toBe("AQID");
    expect(api.getBase64).toHaveBeenCalledOnce();
  });

  it("rejects an unavailable or empty applet export", () => {
    expect(() => getGgbBase64(null)).toThrow("GeoGebra 画布尚未准备完成");
    expect(() => getGgbBase64({ getBase64: () => "" })).toThrow("当前构造无法导出");
  });

  it("creates a stable ggb filename", () => {
    expect(createGgbFilename(new Date("2026-06-24T12:00:00.000Z"))).toBe("geogebra-ai-2026-06-24.ggb");
  });

  it("creates a stable html filename", () => {
    expect(createGgbWebFilename(new Date("2026-06-24T12:00:00.000Z"))).toBe("geogebra-ai-2026-06-24.html");
  });

  it("creates a browser-openable GeoGebra html page", () => {
    const html = createGgbWebPage("AQID", { title: "测试 <构造>", appName: "3d" });

    expect(html).toContain("https://www.geogebra.org/apps/deployggb.js");
    expect(html).toContain('appName: "3d"');
    expect(html).toContain('language: "zh-CN"');
    expect(html).toContain('ggbBase64: "AQID"');
    expect(html).toContain("测试 &lt;构造&gt;");
    expect(html).toContain('applet.inject("ggb-container")');
  });

  it("embeds the current construction state instead of replaying commands", () => {
    const html = createGgbWebPage("CURRENT_BASE64", {
      commands: [
        "k=Slider(0.4,2.4,0.1,1,180,false,true,false,false)",
        "path=Locus(M,k)"
      ]
    });

    expect(html).toContain('ggbBase64: "CURRENT_BASE64"');
    expect(html).not.toContain("api.evalCommand(command)");
    expect(html).not.toContain("path=Locus(M,k)");
  });
});
