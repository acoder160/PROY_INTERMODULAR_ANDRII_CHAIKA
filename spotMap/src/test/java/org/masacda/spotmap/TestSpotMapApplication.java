package org.masacda.spotmap;

import org.springframework.boot.SpringApplication;

public class TestSpotMapApplication {

	public static void main(String[] args) {
		SpringApplication.from(SpotMapApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
