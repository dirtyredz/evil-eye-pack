package packcheck;

import java.io.*;

/** A real JVM regression fixture: valid, invalid bytecode, absent target, no initialization. */
public final class VerifierFixture {
    public static final class Good {
        static { System.setProperty("packcheck.initialized", "yes"); }
        public static String value() { return "valid"; }
    }

    private static byte[] fixtureClass(boolean valid) throws IOException {
        var bytes = new ByteArrayOutputStream();
        var out = new DataOutputStream(bytes);
        out.writeInt(0xcafebabe); out.writeShort(0); out.writeShort(61);
        out.writeShort(8);
        out.writeByte(1); out.writeUTF(valid ? "packcheck/OptionalApi" : "packcheck/Broken"); // #1
        out.writeByte(7); out.writeShort(1);                // #2 Class
        out.writeByte(1); out.writeUTF("java/lang/Object"); // #3
        out.writeByte(7); out.writeShort(3);                // #4 Class
        out.writeByte(1); out.writeUTF("value");            // #5
        out.writeByte(1); out.writeUTF(valid ? "()Lpackcheck/Absent;" : "()Ljava/lang/String;"); // #6
        out.writeByte(1); out.writeUTF("Code");             // #7
        out.writeShort(0x21); out.writeShort(2); out.writeShort(4);
        out.writeShort(0); out.writeShort(0); out.writeShort(1); // interfaces, fields, methods
        out.writeShort(0x09); out.writeShort(5); out.writeShort(6); out.writeShort(1);
        out.writeShort(7); out.writeInt(14); // Code: returns an int as a reference
        out.writeShort(1); out.writeShort(0); out.writeInt(2);
        out.writeByte(valid ? 1 : 3); out.writeByte(176); // aconst_null or iconst_0; areturn
        out.writeShort(0); out.writeShort(0); out.writeShort(0);
        return bytes.toByteArray();
    }

    public static void main(String[] args) throws Exception {
        ClassLoader loader = new ClassLoader(VerifierFixture.class.getClassLoader()) {
            @Override protected Class<?> findClass(String name) throws ClassNotFoundException {
                if (!name.equals("packcheck.Broken") && !name.equals("packcheck.OptionalApi")) throw new ClassNotFoundException(name);
                try { byte[] bytes = fixtureClass(name.endsWith("OptionalApi")); return defineClass(name, bytes, 0, bytes.length); }
                catch (IOException error) { throw new ClassNotFoundException(name, error); }
            }
        };
        TargetVerifier.verify("packcheck.VerifierFixture$Good", loader);
        TargetVerifier.verify("packcheck.OptionalApi", loader);
        if (System.getProperty("packcheck.initialized") != null) throw new AssertionError("Initialized target");
        try { TargetVerifier.verify("packcheck.Broken", loader); throw new AssertionError("Accepted invalid bytecode"); }
        catch (VerifyError expected) { System.out.println("FIXTURE rejected VerifyError: " + expected.getMessage().split("\n")[0]); }
        try { TargetVerifier.verify("packcheck.Missing", loader); throw new AssertionError("Accepted missing target"); }
        catch (ClassNotFoundException expected) { /* expected */ }
        System.out.println("FIXTURE PASS: valid / invalid / missing / no initialization");
    }
}
