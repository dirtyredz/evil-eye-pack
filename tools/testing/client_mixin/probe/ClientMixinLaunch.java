package packcheck;

import java.lang.reflect.Field;
import java.util.*;
import net.neoforged.fml.loading.targets.NeoForgeClientLaunchHandler;
import net.neoforged.fml.loading.LoadingModList;
import org.spongepowered.asm.mixin.MixinEnvironment;
import org.spongepowered.asm.mixin.Mixins;

/** Uses production discovery and transformation, but never enters Minecraft.main. */
public final class ClientMixinLaunch extends NeoForgeClientLaunchHandler {
    @Override public String name() { return "packclientaudit"; }

    private static Object field(Object object, String name) throws Exception {
        Field f = object.getClass().getDeclaredField(name);
        f.setAccessible(true);
        return f.get(object);
    }

    @Override protected void runService(String[] args, ModuleLayer layer) throws Throwable {
        if (LoadingModList.get().hasErrors()) {
            throw new IllegalStateException("Mod discovery failed: " + LoadingModList.get().getModLoadingIssues());
        }
        ClassLoader loader = layer.findLoader("minecraft");
        Thread.currentThread().setContextClassLoader(loader);
        System.out.println("PACK_AUDIT CLIENT " + MixinEnvironment.getCurrentEnvironment().getSide());
        int failures = 0;
        // A harmless game class triggers Mixin's normal config preparation.
        Class.forName("net.minecraft.SharedConstants", false, loader);
        Object transformer = MixinEnvironment.getCurrentEnvironment().getActiveTransformer();
        Object processor = field(transformer, "processor");
        List<?> configs = (List<?>) field(processor, "configs");
        Set<String> targets = new TreeSet<>();
        for (Object config : configs) {
            var method = config.getClass().getDeclaredMethod("getTargets");
            method.setAccessible(true);
            for (Object target : (Set<?>) method.invoke(config)) targets.add(target.toString());
            System.out.println("PACK_AUDIT CONFIG " + config);
        }
        System.out.println("PACK_AUDIT CONFIGS " + configs.size() + " TARGETS " + targets.size());
        for (String target : targets) {
            try {
                TargetVerifier.verify(target, loader);
                System.out.println("PACK_AUDIT VERIFIED " + target);
            } catch (Throwable error) {
                failures++;
                System.out.println("PACK_AUDIT FAILED " + target);
                error.printStackTrace(System.out);
            }
        }
        if (targets.isEmpty() || Mixins.getUnvisitedCount() != 0) failures++;
        for (Object config : configs) {
            var method = config.getClass().getDeclaredMethod("getUnhandledTargets");
            method.setAccessible(true);
            Set<?> pending = (Set<?>) method.invoke(config);
            if (!pending.isEmpty()) {
                failures++;
                System.out.println("PACK_AUDIT UNHANDLED " + config + " " + pending);
            }
        }
        System.out.println("PACK_AUDIT COMPLETE targets=" + targets.size() + " failures=" + failures);
        System.exit(failures == 0 ? 0 : 1);
    }
}
