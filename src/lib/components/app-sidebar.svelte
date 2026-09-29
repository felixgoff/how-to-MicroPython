<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { router } from "$lib/router.svelte.js";
	import { componentGuides } from "$lib/data/components/index.js";
</script>

<Sidebar.Root>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Pico WH Guide</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton isActive={router.path === "/"}>
							{#snippet child({ props })}
								<a href="#/" {...props}>
									<span>Introduktion</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Komponenter</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each componentGuides as guide (guide.slug)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton isActive={router.component === guide.slug}>
								{#snippet child({ props })}
									<a href={`#/komponent/${guide.slug}`} {...props}>
										<span>{guide.title}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>
