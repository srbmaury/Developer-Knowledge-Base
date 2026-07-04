/**
 * Tests for the async workspace-io functions: importWorkspaceFromZip and
 * exportWorkspaceToZip (filterCategories logic is exercised via these).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, Question, Tag } from "@/types/knowledge";

// ── mock server actions ───────────────────────────────────────────────────────

const mockBulkImport = vi.fn();
const mockGetExportContent = vi.fn();

vi.mock("@/app/actions", () => ({
  bulkImportAction: (...args: unknown[]) => mockBulkImport(...args),
  getExportContentAction: (...args: unknown[]) => mockGetExportContent(...args),
}));

const mockToast = {
  loading: vi.fn().mockReturnValue("toast-id"),
  error: vi.fn(),
  success: vi.fn(),
  dismiss: vi.fn(),
};
vi.mock("sonner", () => ({ toast: mockToast }));

// ── JSZip mock ────────────────────────────────────────────────────────────────

// Capture instances created by new JSZip() so export tests can inspect file calls.
type ZipInstance = { file: ReturnType<typeof vi.fn>; generateAsync: ReturnType<typeof vi.fn>; files: Record<string, unknown> };
let capturedZipInstance: ZipInstance | null = null;

type MockEntry = { dir: boolean; async: (_type: string) => Promise<string> };
let mockZipFiles: Record<string, MockEntry> = {};

vi.mock("jszip", () => {
  class MockJSZip {
    files = mockZipFiles;
    file = vi.fn();
    generateAsync = vi.fn().mockResolvedValue(new Blob(["zip"]));
    static loadAsync = vi.fn().mockImplementation(() => {
      const inst = new MockJSZip();
      inst.files = mockZipFiles;
      return Promise.resolve(inst);
    });
    constructor() {
      capturedZipInstance = this as unknown as ZipInstance;
    }
  }
  return { default: MockJSZip };
});

// ── DOM stubs ─────────────────────────────────────────────────────────────────

const mockAnchor = { href: "", download: "", click: vi.fn() };
vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(mockAnchor) });
// Extend the existing URL class so new URL() keeps working in Node internals
Object.defineProperty(URL, "createObjectURL", { value: vi.fn().mockReturnValue("blob:mock"), writable: true, configurable: true });
Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), writable: true, configurable: true });

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEntry(content: string): MockEntry {
  return { dir: false, async: () => Promise.resolve(content) };
}
function makeDirEntry(): MockEntry {
  return { dir: true, async: () => Promise.resolve("") };
}
function makeFile(name: string): File {
  return new File(["dummy"], name, { type: "application/zip" });
}

function makeQ(id: string, opts?: { status?: Question["status"]; categoryId?: string; tags?: Tag[] }): Question {
  return {
    id, categoryId: opts?.categoryId ?? "cat-a",
    title: `Q-${id}`, description: "", difficulty: "MEDIUM",
    isFavorite: false, isPinned: false, order: 0,
    status: opts?.status ?? "NOT_STARTED",
    srDue: null, srInterval: 1, srEase: 2.5, srReviews: 0,
    createdAt: "", updatedAt: "", solutions: [],
    tags: opts?.tags ?? [],
  };
}

function makeCat(id: string, questions: Question[], children: Category[] = []): Category {
  return { id, userId: "u1", name: id, isPublic: false, canEdit: true, parentId: null, order: 0, createdAt: "", children, questions };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockZipFiles = {};
  capturedZipInstance = null;
  mockToast.loading.mockReturnValue("toast-id");
  mockBulkImport.mockResolvedValue({ ok: true, questions: 3, categories: 2 });
  mockGetExportContent.mockResolvedValue({ ok: true, content: {} });
  mockAnchor.click = vi.fn();
  mockAnchor.href = "";
  mockAnchor.download = "";
});

afterEach(() => { mockZipFiles = {}; });

// ─────────────────────────────────────────────────────────────────────────────
// importWorkspaceFromZip
// ─────────────────────────────────────────────────────────────────────────────

describe("importWorkspaceFromZip", () => {
  it("shows error toast when zip has no markdown files", async () => {
    mockZipFiles = { "folder/": makeDirEntry() };
    const { importWorkspaceFromZip } = await import("@/lib/workspace-io");
    await importWorkspaceFromZip(makeFile("empty.zip"), vi.fn());
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining("No markdown"),
      expect.anything()
    );
  });

  it("shows error toast when md files are only at the root (no folders)", async () => {
    mockZipFiles = { "note.md": makeEntry("# Bare note") };
    const { importWorkspaceFromZip } = await import("@/lib/workspace-io");
    await importWorkspaceFromZip(makeFile("root-only.zip"), vi.fn());
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining("No categories"),
      expect.anything()
    );
  });

  it("calls bulkImportAction with a parsed import tree", async () => {
    mockZipFiles = {
      "Algorithms/": makeDirEntry(),
      "Algorithms/binary-search.md": makeEntry("# Binary Search\n---\ncode here"),
    };
    const refresh = vi.fn();
    const { importWorkspaceFromZip } = await import("@/lib/workspace-io");
    await importWorkspaceFromZip(makeFile("valid.zip"), refresh);

    expect(mockBulkImport).toHaveBeenCalledOnce();
    const [tree] = mockBulkImport.mock.calls[0] as [{ name: string }[]];
    expect(tree[0].name).toBe("Algorithms");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows singular/plural success toast based on counts", async () => {
    mockZipFiles = {
      "DS/": makeDirEntry(),
      "DS/arrays.md": makeEntry("# Arrays"),
    };
    mockBulkImport.mockResolvedValueOnce({ ok: true, questions: 1, categories: 1 });
    const { importWorkspaceFromZip } = await import("@/lib/workspace-io");
    await importWorkspaceFromZip(makeFile("ok.zip"), vi.fn());
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("1 note"));
  });

  it("shows error toast when bulkImportAction returns not ok", async () => {
    mockZipFiles = {
      "Cat/": makeDirEntry(),
      "Cat/q.md": makeEntry("# Q"),
    };
    mockBulkImport.mockResolvedValueOnce({ ok: false, message: "Server exploded" });
    const { importWorkspaceFromZip } = await import("@/lib/workspace-io");
    await importWorkspaceFromZip(makeFile("fail.zip"), vi.fn());
    expect(mockToast.error).toHaveBeenCalledWith("Server exploded");
  });

  it("parses nested folders into a nested ImportNode tree", async () => {
    mockZipFiles = {
      "Parent/": makeDirEntry(),
      "Parent/Child/": makeDirEntry(),
      "Parent/Child/note.md": makeEntry("# Note"),
    };
    const { importWorkspaceFromZip } = await import("@/lib/workspace-io");
    await importWorkspaceFromZip(makeFile("nested.zip"), vi.fn());

    const [tree] = mockBulkImport.mock.calls[0] as [{ name: string; children: { name: string }[] }[]];
    expect(tree[0].name).toBe("Parent");
    expect(tree[0].children[0].name).toBe("Child");
  });

  it("handles a thrown error (corrupt zip) with an error toast", async () => {
    const JSZip = (await import("jszip")).default as unknown as { loadAsync: ReturnType<typeof vi.fn> };
    JSZip.loadAsync.mockRejectedValueOnce(new Error("corrupt zip"));
    const { importWorkspaceFromZip } = await import("@/lib/workspace-io");
    await importWorkspaceFromZip(makeFile("corrupt.zip"), vi.fn());
    expect(mockToast.error).toHaveBeenCalledWith("Failed to import zip");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// exportWorkspaceToZip
// ─────────────────────────────────────────────────────────────────────────────

describe("exportWorkspaceToZip", () => {
  it("shows error toast when getExportContentAction fails", async () => {
    mockGetExportContent.mockResolvedValueOnce({ ok: false });
    const { exportWorkspaceToZip } = await import("@/lib/workspace-io");
    await exportWorkspaceToZip([makeCat("cat-a", [makeQ("q1")])]);
    expect(mockToast.error).toHaveBeenCalledWith(
      expect.stringContaining("Export failed"),
      expect.anything()
    );
    expect(mockAnchor.click).not.toHaveBeenCalled();
  });

  it("triggers a download anchor click on success", async () => {
    const { exportWorkspaceToZip } = await import("@/lib/workspace-io");
    await exportWorkspaceToZip([makeCat("cat-a", [makeQ("q1")])]);
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it("adds one .md file per question to the zip", async () => {
    const { exportWorkspaceToZip } = await import("@/lib/workspace-io");
    await exportWorkspaceToZip([makeCat("AlgoCategory", [makeQ("q1"), makeQ("q2")])]);

    const filePaths = (capturedZipInstance!.file.mock.calls as [string, string][]).map(([p]) => p);
    const mdFiles = filePaths.filter((p) => p.endsWith(".md"));
    expect(mdFiles).toHaveLength(2);
  });

  it("filters out questions whose status does not match filterStatus", async () => {
    const questions = [
      makeQ("q-solved", { status: "SOLVED" }),
      makeQ("q-unsolved", { status: "NOT_STARTED" }),
    ];
    const { exportWorkspaceToZip } = await import("@/lib/workspace-io");
    await exportWorkspaceToZip([makeCat("cat-a", questions)], { filterStatus: "SOLVED" });

    const filePaths = (capturedZipInstance!.file.mock.calls as [string, string][]).map(([p]) => p);
    const mdFiles = filePaths.filter((p) => p.endsWith(".md"));
    expect(mdFiles).toHaveLength(1);
    expect(mdFiles[0]).toContain("q-solved");
  });

  it("skips a category whose questions all fail the tag filter", async () => {
    const questions = [makeQ("q1", { tags: [{ id: "t2", name: "other", color: "gray" }] })];
    const { exportWorkspaceToZip } = await import("@/lib/workspace-io");
    await exportWorkspaceToZip([makeCat("cat-a", questions)], { filterTagIds: ["t1"] });

    const filePaths = (capturedZipInstance?.file.mock.calls as [string, string][] | undefined ?? []).map(([p]) => p);
    expect(filePaths.filter((p) => p.endsWith(".md"))).toHaveLength(0);
  });

  it("exports only questions in the selected category when selectedCategoryId is set", async () => {
    const q1 = makeQ("q1", { categoryId: "cat-a" });
    const q2 = makeQ("q2", { categoryId: "cat-b" });
    const { exportWorkspaceToZip } = await import("@/lib/workspace-io");
    await exportWorkspaceToZip(
      [makeCat("cat-a", [q1]), makeCat("cat-b", [q2])],
      { selectedCategoryId: "cat-a" }
    );

    const filePaths = (capturedZipInstance!.file.mock.calls as [string, string][]).map(([p]) => p);
    const mdFiles = filePaths.filter((p) => p.endsWith(".md"));
    expect(mdFiles).toHaveLength(1);
    expect(mdFiles[0]).toContain("cat-a");
  });
});
