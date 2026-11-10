# BilaScript integration boundary

BilaScript v4 is a **frontend targeting JavaScript**, not an implemented native C++/Java/Python/Swift compiler. The source file \`bridge.bila\` demonstrates BilaScript semantic keywords such as \`haml_sob\`, \`neub\`, \`trov_ved\`, and \`bilb\` from the upstream project.

Pipeline: BilaScript -> official BilaScript v4 frontend -> JavaScript runtime -> CVNSS4.0 converter / VF1 API -> portable C++ / Java / Python / Swift VF1 clients.

No claim is made that this sample was compiled with BilaScript v4 until the upstream compiler is invoked in the reproducibility workflow. For authoritative syntax and CLI, see https://github.com/xulytiengviet/bilascript.

CVNSS4.0's mapping graph is versioned in \`docs/assets/cvnss-converter.js\`, which is the actual converter used on the website.
