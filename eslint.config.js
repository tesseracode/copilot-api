import config from "@echristian/eslint-config"

export default [
  { ignores: ["scripts/**"] },
  ...config({
    prettier: {
      plugins: ["prettier-plugin-packagejson"],
    },
  }),
]
