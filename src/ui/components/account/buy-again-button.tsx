"use client";

import { useState, useTransition } from "react";
import { SaleorImage } from "@/ui/atoms/saleor-image";
import { useTranslations } from "next-intl";
import { ListChecks, Package, RotateCcw, SlidersHorizontal, ShoppingBag } from "lucide-react";
import { buyAgain } from "@/app/actions";
import { bumpChromeVersion } from "@/lib/chrome-sync";
import { LinkWithChannel } from "@/ui/atoms/link-with-channel";
import { Button } from "@/ui/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "quick" | "pick" | "edit";
type Item = {
	id: string;
	name: string;
	variant: string;
	quantity: number;
	available: boolean;
	gift: boolean;
	image?: string;
};
type Props = { orderId: string; channel: string; locale: string; after?: string; items: Item[] };

export function BuyAgainOptions({ orderId, channel, locale, after, items }: Props) {
	const t = useTranslations("account.buyAgain");
	const [mode, setMode] = useState<Mode>("quick");
	const [quantities, setQuantities] = useState<Record<string, number>>(() =>
		Object.fromEntries(items.map((item) => [item.id, item.available ? item.quantity : 0])),
	);
	const [pending, startTransition] = useTransition();
	const [outcome, setOutcome] = useState<Awaited<ReturnType<typeof buyAgain>> | null>(null);
	const setQuantity = (id: string, value: number) =>
		setQuantities((previous) => ({ ...previous, [id]: value }));
	const count = items.reduce(
		(sum, item) => sum + (item.available ? (mode === "quick" ? item.quantity : quantities[item.id] || 0) : 0),
		0,
	);
	const submit = () =>
		startTransition(async () => {
			setOutcome(null);
			try {
				const result = await buyAgain(orderId, channel, locale, after, mode === "quick" ? null : quantities);
				setOutcome(result);
				if (result.added || result.failed) bumpChromeVersion();
			} catch {
				setOutcome({ added: 0, skipped: [], failed: true });
			}
		});
	return (
		<section aria-label={t("group")} className="space-y-4 border-t px-5 py-4">
			<div
				role="group"
				aria-label={t("group")}
				className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-secondary/60 p-1"
			>
				{(
					[
						["quick", RotateCcw],
						["pick", ListChecks],
						["edit", SlidersHorizontal],
					] as const
				).map(([option, Icon]) => (
					<button
						type="button"
						disabled={pending}
						aria-pressed={mode === option}
						key={option}
						onClick={() => {
							if (mode === option) return;
							setMode(option);
							setOutcome(null);
							setQuantities(Object.fromEntries(items.map((i) => [i.id, i.available ? i.quantity : 0])));
						}}
						className={cn(
							"inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground",
							mode === option && "bg-background text-foreground shadow-sm",
						)}
					>
						<Icon aria-hidden="true" className="size-4" />
						{t(option)}
					</button>
				))}
			</div>
			<p className="text-sm">{items.some((item) => item.available) ? t(`${mode}Hint`) : t("soldOut")}</p>
			{mode !== "quick" && (
				<ul className="divide-y rounded-lg border">
					{items.map((item) => (
						<li key={item.id} className="flex items-center gap-3 px-3 py-3">
							{mode === "pick" && (
								<input
									type="checkbox"
									aria-label={item.name}
									checked={quantities[item.id] > 0}
									disabled={!item.available || pending}
									onChange={(e) => setQuantity(item.id, e.target.checked ? item.quantity : 0)}
									className="size-4 accent-primary"
								/>
							)}
							<div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary/50">
								{item.image ? (
									<SaleorImage
										src={item.image}
										sizes="44px"
										srcSet={`${item.image} 256w`}
										alt=""
										className="size-full object-contain"
									/>
								) : (
									<Package aria-hidden="true" className="size-5 text-muted-foreground" />
								)}
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium">{item.name}</p>
								<p className="text-xs text-muted-foreground">
									{[item.variant, t("previous", { count: item.quantity })].filter(Boolean).join(" · ")}
								</p>
							</div>
							{!item.available ? (
								<span className="text-xs text-muted-foreground">{t(item.gift ? "gift" : "unavailable")}</span>
							) : (
								mode === "edit" && (
									<input
										type="number"
										min={0}
										max={999}
										step={1}
										aria-label={t("quantity", { name: item.name })}
										disabled={pending}
										value={quantities[item.id] || ""}
										placeholder="0"
										onChange={(e) =>
											setQuantity(
												item.id,
												Math.min(999, Math.max(0, Math.trunc(Number(e.target.value)) || 0)),
											)
										}
										className="h-10 w-16 rounded-md border bg-background px-2 text-center text-sm tabular-nums"
									/>
								)
							)}
						</li>
					))}
				</ul>
			)}
			<div className="flex flex-wrap items-center gap-3">
				<Button type="button" disabled={!count || pending} onClick={submit}>
					<ShoppingBag aria-hidden="true" className="size-4" />
					{pending ? t("busy") : t(`${mode}Action`)}
				</Button>
				{mode !== "quick" && <span className="text-sm text-muted-foreground">{t("units", { count })}</span>}
			</div>
			<p className="text-xs text-muted-foreground">{t("priceNote")}</p>
			<div role="status" aria-live="polite">
				{outcome && (
					<div className="space-y-1 rounded-lg bg-secondary/50 px-4 py-3 text-sm">
						{outcome.added > 0 ? (
							<p className="font-medium">{t("success", { count: outcome.added })}</p>
						) : (
							!outcome.failed && <p>{t("none")}</p>
						)}
						{outcome.skipped.length > 0 && <p>{t("skipped", { names: outcome.skipped.join(", ") })}</p>}
						{outcome.failed && <p>{t("error")}</p>}
						{(outcome.added > 0 || outcome.failed) && (
							<LinkWithChannel href="/cart" className="inline-block font-medium underline underline-offset-4">
								{t("cart")}
							</LinkWithChannel>
						)}
					</div>
				)}
			</div>
		</section>
	);
}
