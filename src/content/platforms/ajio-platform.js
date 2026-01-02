import { StubPlatform } from "./platform-stub-template.js";

export default class AjioPlatform extends StubPlatform {
    constructor() {
        super("ajio", ["ajio.com"]);
    }
}

