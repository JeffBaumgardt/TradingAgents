import { describe, expect, it } from "vitest";
import { render, screen } from "./test-utils";

describe("vitest + RTL smoke", () => {
  it("renders and queries by role", () => {
    render(<div role="status">ok</div>);
    expect(screen.getByRole("status")).toHaveTextContent("ok");
  });
});
