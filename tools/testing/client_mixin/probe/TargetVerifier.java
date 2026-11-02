package packcheck;

public final class TargetVerifier {
    private TargetVerifier() {}

    public static void verify(String name, ClassLoader loader) throws ClassNotFoundException {
        Class<?> type = Class.forName(name, false, loader);
        // Constructor reflection links/verifies the whole class without running <clinit>.
        // Method reflection also resolves every method signature (including absent optional APIs).
        type.getDeclaredConstructors();
    }
}
