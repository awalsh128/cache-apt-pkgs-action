# cache-apt-pkgs-action - Version 2 FAQ

## Why did you create a new version

### Bash Scripts

Bash shell scripting grew in complexity and became very unreadable. The action needed higher level language idioms like array and map handling, complex pattern matching, and complex text processing.

### Language Choice

Languages like Python, Go, Rust, etc. have performance and writeability trade offs that would greatly improve this action, but ultimately Typescript was chosen because:

- it is the most performant and well supported for GitHub actions;
- native strongly types libraries for action args and actions like caching;
- provides a balance of code comprehension for contributors and performance; and
- allows for better integration, CI, regression testing, and release workflows.

## Where did all the APT functionality go?

Since this has been a complex part of the codebase, I decided to separate the concern as its own library. This can now be found in [npm/ts-apt](https://www.npmjs.com/package/ts-apt). For ease of use there is an option to bring in the workspace for inline source so it can be debugged and then committed to the [ts-apt](http://github.com/awalsh128/ts-apt) repository.

## How do I start using this?

> [!IMPORTANT]
> This is still in beta so use at your own risk!

For now you can use the `v2.*` release tags (pinning also supported). Once this version has had time to soak it will be released as the latest. `v1.*` will still get updates but in maintenance mode.
