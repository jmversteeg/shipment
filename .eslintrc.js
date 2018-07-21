module.exports = {
    "env":           {
        "es6":  true,
        "node": true
    },
    "parserOptions": {
        "ecmaVersion":  2018,
        "sourceType":   "module",
    },
    "extends":       "eslint:recommended",
    "rules":         {
        "indent":          [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes":          [
            "error",
            "single"
        ],
        "semi":            [
            "error",
            "always"
        ]
    }
};