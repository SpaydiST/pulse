# Pulse add-on template

This is a small, separately installed Paper plugin that demonstrates Pulse API discovery, event listening, and player data extensions.

1. Copy the built `pulse-1.0.0.jar` to `libs/Pulse-1.0.0.jar`.
2. Run `gradle build` in this folder.
3. Install `build/libs/pulse-addon-example-1.0.0.jar` in the server's `plugins/` directory alongside Pulse.

The add-on declares a required Paper dependency on `pulse`, then loads `PulseApi` from Bukkit's `ServicesManager`. It registers an extension and stores the last PvP kill asynchronously. See [`docs/modules.md`](../../docs/modules.md) for the API contract and install notes.
