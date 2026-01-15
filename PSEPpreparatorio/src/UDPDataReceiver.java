import java.net.*;

public class UDPDataReceiver {
    private int port;
    private static final double PAQUETE_PORCENTAJE_PERDIDA = 0.3; // 30% de pérdida

    public UDPDataReceiver(int port) {
        this.port = port;
    }

    public void start() {
        System.out.println(">> [UDP] Receptor Inteligente iniciado en puerto " + port);

        // último ID válido.
        int lastReceivedId = 0;

        try (DatagramSocket socket = new DatagramSocket(port)) {
            byte[] buffer = new byte[1024];
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);

            while (true) {
                socket.receive(packet);

                // Simulando red mala
                if (Math.random() < PAQUETE_PORCENTAJE_PERDIDA) {
                    System.out.print("X");
                    continue;
                }

                // Procesamos el mensaje real
                String rawData = new String(packet.getData(), 0, packet.getLength());

                // MENSAJE (Formato: ID;DATO)
                try {
                    String[] parts = rawData.split(";");
                    int currentId = Integer.parseInt(parts[0]);
                    String content = parts[1];

                    // --- LÓGICA DE DETECCIÓN DE PÉRDIDA ---
                    // Si el ID que llega NO es el siguiente al que teníamos...
                    if (currentId > lastReceivedId + 1) {
                        long lostPackets = currentId - lastReceivedId - 1;
                        System.out.println("\n[!] ALERTA: Salto de secuencia detectado.");
                        System.out.println("    Último visto: " + lastReceivedId + " -> Actual: " + currentId);
                        System.out.println("    >> SE HAN PERDIDO " + lostPackets + " PAQUETES <<");
                    }

                    // Actualizamos el último visto
                    lastReceivedId = currentId;

                    System.out.println("   [V] #" + currentId + " Procesado: " + content);

                } catch (Exception e) {
                    System.err.println("Error procesando paquete corrupto: " + rawData);
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void main(String[] args) {
        new UDPDataReceiver(5001).start();
    }
}