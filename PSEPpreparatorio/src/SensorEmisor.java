import java.io.IOException;
import java.net.*;
import java.util.Random;
public class SensorEmisor {
    public static void main(String[] args) {
        String receiverHost = "localhost";
        int receiverPort = 5001;
        System.out.println("Iniciando Sensor-Emisor...");
        // Fíjate: No especificamos puerto ni IP en el constructor del socket.
        try (DatagramSocket socket = new DatagramSocket()) {
            // Resolvemos la dirección IP una vez
            InetAddress address = InetAddress.getByName(receiverHost);
            Random random = new Random();
            // Simulamos el envio de temperatura de 20 a 30 grados.

            long sequenceNumber = 0;
            while (true) {
                sequenceNumber++;
                double temp = 20.0 + (Math.random() * 10.0);

                //NUEVO FORMATO: ID;DATO
                String message = sequenceNumber + ";TEMP:" + String.format("%.2f", temp);

                byte[] buffer = message.getBytes();
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length, address, 5001);

                socket.send(packet);
                System.out.println(">> [UDP] Enviado #" + sequenceNumber + ": " + message);

                Thread.sleep(2000);
            }
        } catch (SocketException e) {
            e.printStackTrace();
        } catch (UnknownHostException e) {
            System.err.println("No se encuentra el host: " + receiverHost);
        } catch (IOException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }
}