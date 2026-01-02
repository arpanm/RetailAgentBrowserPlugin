import { StubPlatform } from "./platform-stub-template.js";

export default class JioMartPlatform extends StubPlatform {
    constructor() {
        super("jiomart", ["jiomart.com"]);
    }
}

