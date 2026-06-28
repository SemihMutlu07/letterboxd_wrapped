import { defineConfig } from "deepsec/config";

export default defineConfig({
  projects: [
    { id: "letterboxd_wrapped", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});
