package dev.example.pulseaddon;

import org.bukkit.Bukkit;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.plugin.java.JavaPlugin;
import org.example1.pulse.api.PulseApi;
import org.example1.pulse.api.PulseExtension;
import org.example1.pulse.api.event.PulsePlayerKillEvent;

import java.util.UUID;

/** Example of a separately installed Paper plugin that extends Pulse. */
public final class PulseAddonExample extends JavaPlugin implements Listener, PulseExtension {

    private PulseApi pulse;

    @Override
    public void onEnable() {
        pulse = Bukkit.getServicesManager().load(PulseApi.class);
        if (pulse == null) {
            getLogger().severe("Pulse API v1 was not registered. Check api.enabled and Pulse startup.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        if (PulseApi.API_VERSION != 1) {
            getLogger().severe("This add-on needs Pulse API v1.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        pulse.registerExtension(this, this);
        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("Connected to Pulse API v" + PulseApi.API_VERSION);
    }

    @Override
    public void onDisable() {
        if (pulse != null) {
            pulse.unregisterExtensions(this);
            pulse = null;
        }
    }

    @Override
    public String id() {
        return "example_addon";
    }

    @Override
    public String name() {
        return "Example add-on";
    }

    @EventHandler
    public void onPlayerKill(PulsePlayerKillEvent event) {
        UUID killer = event.killer().getUniqueId();
        String payload = "{\"victimUuid\":\"" + event.victim().getUniqueId()
                + "\",\"time\":" + event.time() + "}";
        PulseApi api = pulse;
        if (api == null) return;
        Bukkit.getScheduler().runTaskAsynchronously(this, () ->
                api.saveExtensionData(killer, id(), "last_pvp_kill", payload));
    }
}
