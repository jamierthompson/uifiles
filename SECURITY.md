# Security policy

uifiles is a component registry: the code it distributes runs in your application, not on a
server we operate. Please report anything that could let a registry item execute unexpected
code, exfiltrate data, or break out of the shadcn CLI's install step, and anything on the
docs site or in `/r/*.json` that could mislead an installer.

## Reporting

Use GitHub's private vulnerability reporting for this repository:
https://github.com/jamierthompson/uifiles/security/advisories/new

Do not open a public issue for security reports. You will get an acknowledgement within seven
days and a fix or a decision within thirty.

## Supported versions

Registries are unversioned by design: consumers copy source at install time. Fixes land on
`main` and in the latest tag; older tags are not patched.
