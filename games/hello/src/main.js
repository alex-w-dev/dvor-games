const el = document.getElementById("player");

async function main() {
  if (typeof PlatformSDK === "undefined") {
    el.textContent = "SDK недоступен (откройте через /play или /draft)";
    return;
  }
  try {
    const sdk = await PlatformSDK.init();
    const player = await sdk.getPlayer();
    el.textContent = player.authorized
      ? `Игрок: ${player.id}`
      : `Гость: ${player.id}`;
  } catch (err) {
    el.textContent = "SDK: " + (err?.message || String(err));
  }
}

main();
