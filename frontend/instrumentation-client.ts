import { initBotId } from "botid/client/core";

const basic = { checkLevel: "basic" as const };

initBotId({
  protect: [
    { path: "/models/ticket", method: "GET", advancedOptions: basic },
    { path: "/models/hybrid", method: "POST", advancedOptions: basic },
    { path: "/models/vision-match", method: "POST", advancedOptions: basic },
  ],
});
