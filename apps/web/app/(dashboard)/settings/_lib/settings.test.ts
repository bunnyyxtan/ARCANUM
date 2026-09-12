import { describe, expect, it } from "vitest";

import { canRemoveTeamMember } from "./settings";

const OWNER = "0x0000000000000000000000000000000000000001";
const REVIEWER = "0x0000000000000000000000000000000000000002";

describe("canRemoveTeamMember", () => {
  it("allows an owner to remove an unrelated member, including another owner", () => {
    expect(canRemoveTeamMember({ wallet: REVIEWER, rawRole: "viewer" }, true, OWNER)).toBe(true);
    expect(canRemoveTeamMember({ wallet: REVIEWER, rawRole: "owner" }, true, OWNER)).toBe(true);
  });

  it("keeps viewers, the current owner, and missing-owner-address actions protected", () => {
    expect(canRemoveTeamMember({ wallet: REVIEWER, rawRole: "viewer" }, false, OWNER)).toBe(false);
    expect(canRemoveTeamMember({ wallet: OWNER, rawRole: "owner" }, true, OWNER)).toBe(false);
    expect(canRemoveTeamMember({ wallet: REVIEWER, rawRole: "viewer" }, true)).toBe(false);
  });
});
