const form = document.getElementById("payment-form");
const successCard = document.getElementById("payment-success");
const payBtn = document.getElementById("pay-btn");

function setPayLoading(isLoading) {
  if (!payBtn) return;
  payBtn.disabled = isLoading;
  payBtn.textContent = isLoading ? "Processing..." : "Pay & Upgrade";
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setPayLoading(true);

  await new Promise((resolve) => setTimeout(resolve, 900));

  form.classList.add("hidden");
  successCard?.classList.remove("hidden");
  setPayLoading(false);
});

