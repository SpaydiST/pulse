# Pulse add-on modules

Pulse add-ons are ordinary Paper plugins installed beside Pulse in the server's `plugins/` directory. Paper loads them after Pulse using the declared dependency and exposes Pulse's API classloader to them. Pulse does not scan arbitrary JAR files or run a custom classloader.

The public contract is `PulseApi` (`API_VERSION = 1`) and the events in `org.example1.pulse.api.event`. Enable it with `api.enabled: true` in `plugins/Pulse/config.yml`. An add-on should resolve the API from Paper's service registry:

```java
PulseApi api = Bukkit.getServicesManager().load(PulseApi.class);
if (api == null) {
    getLogger().severe("Pulse API is unavailable");
    getServer().getPluginManager().disablePlugin(this);
    return;
}
```

Declare the runtime dependency in the add-on's `paper-plugin.yml` so Paper starts Pulse first and shares its public API classes:

```yaml
dependencies:
  server:
    pulse:
      load: BEFORE
      required: true
      join-classpath: true
```

For compilation, add the distributed Pulse JAR as `compileOnly` in the add-on project. Never shade or bundle Pulse classes into an add-on. The working sample is in [`examples/pulse-addon-template`](../examples/pulse-addon-template).

An add-on can implement `PulseExtension` and call `api.registerExtension(this, extension)`. IDs must be lowercase and match `[a-z0-9][a-z0-9_-]{0,63}`. IDs are owned by the registering plugin; a different add-on cannot replace them. Registrations are removed automatically when their owner disables. `unregisterExtensions(this)` is also available for explicit cleanup.

The optional PlaceholderAPI integration is shipped separately as `pulse-placeholder/build/libs/pulse-placeholder-1.0.0.jar`. Install it only when PlaceholderAPI is installed. It depends on Pulse and reads cached player data through `PulseApi`.

Milestone tracking is an optional Paper plugin in `pulse-milestones/build/libs/pulse-milestones-1.0.0.jar`. It uses the public API for player activity and milestone claims; configure it in `plugins/PulseMilestones/config.yml`. On its first start it imports the legacy `milestones` section from `plugins/Pulse/config.yml`.
