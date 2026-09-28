/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    student: import("./lib/schema").Student | null;
  }
}
