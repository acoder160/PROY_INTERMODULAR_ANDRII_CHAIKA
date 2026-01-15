import java.io.*;
import java.net.*;
import java.util.Scanner;

public class UDPClient {
    public static void main(String[] args) {
        String host = "localhost";
        int port = 11000; // Puerto TCP del servidor

        try (
                Socket socket = new Socket(host, port);
                PrintWriter out = new PrintWriter(socket.getOutputStream(), true);
                BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                Scanner scanner = new Scanner(System.in)
        ) {
            // 1. Leer saludo del servidor
            System.out.println("Servidor dice: " + in.readLine());

            while (true) {
                // 2. Escribir comando
                System.out.print("Escribe comando (UDP_ON / UDP_OFF): ");
                String userInput = scanner.nextLine();
                out.println(userInput);

                // 3. Leer respuesta
                String response = in.readLine();
                System.out.println("Servidor responde: " + response);

                if (response.equals("Bye.")) break;
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}