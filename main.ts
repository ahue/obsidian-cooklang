import { App, Component, Editor, MarkdownPostProcessorContext, MarkdownRenderChild, MarkdownRenderer, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { Cookware, Ingredient, Metadata, Recipe, Step } from 'cooklang';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});


		this.registerMarkdownCodeBlockProcessor("cooklang",
			async (source: string, el, ctx) => {
				console.log("in the markdown code block processor");
				this.cooklang(source, el, ctx, ctx.sourcePath);
			}
		)

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click1', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	public async cooklang(source: string, el: HTMLElement, component: Component | MarkdownPostProcessorContext, sourcePath: string) {
		const recipe = new Recipe(source);

		component.addChild(
			new RecipeRenderer(recipe, el, sourcePath)
		)


		console.log(recipe)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class RecipeRenderer extends MarkdownRenderChild  {
	
	constructor(
		public recipe: Recipe,
		public container: HTMLElement,
		public origin: string
	) {
		super(container)
	}

	onload(): void {
		this.render()
	}

	async render() {

		console.log("in render")
		this.container.innerHTML = "";

		// TODO: Setting: Heading level (# ## ###)

		await MarkdownRenderer.renderMarkdown("## Ingredients", this.container, this.origin, this) // TODO: Setting: Ingredients

		let listEl = this.container.createEl("ul")
		for (let ingr of this.recipe.ingredients) {
			let li = listEl.createEl("li")
			let subcontainer = li.createSpan();
			await this.renderCompactMarkdown(this.renderIngredient(ingr), subcontainer, this.origin, this)
		}

		await MarkdownRenderer.renderMarkdown("## Cookware", this.container, this.origin, this) // TODO: Setting: Cookware heading

		listEl = this.container.createEl("ul")
		for (let cookw of this.recipe.cookware) {
			let li = listEl.createEl("li")
			let subcontainer = li.createSpan();
			await this.renderCompactMarkdown(this.renderCookware(cookw), subcontainer, this.origin, this)
		}

		await MarkdownRenderer.renderMarkdown("## Steps", this.container, this.origin, this) // TODO: Setting: Steps heading

		// TODO: Setting: Steps as ordered list, unordered list, paragraphs
		listEl = this.container.createEl("ol")
		for (let step of this.recipe.steps) {
			let li = listEl.createEl("li")
			let subcontainer = li.createSpan();
			await this.renderCompactMarkdown(this.renderStep(step), subcontainer, this.origin, this)
			
		}

		await MarkdownRenderer.renderMarkdown("## Image", this.container, this.origin, this)

		// TODO: cooklang: Meta data object as key-value object
		let imgMeta = this.recipe.metadata.filter((value) => value.key === "image")
		if (imgMeta.length > 0) {
			for (let img of imgMeta) {
				await MarkdownRenderer.renderMarkdown((img as Metadata).value, this.container, this.origin, this)
			}
			
		}
		
	}


	renderStep(step: Step) {
		let stepStr = ""
		// let block: string | Ingredient | Cookware
		for (let block of step.line) {
			if (typeof block === "string") {
				stepStr = stepStr + ` ${block} ` 
			}
			else if(block instanceof Ingredient) {
				let item: Ingredient = block
				if (item.quantity > 0) {
					
					stepStr = stepStr + ` **${item.amount}${item.units} ${item.name}** `
				}
				else {
					stepStr += ` **${item.name}** `
				}
			}
			else if(block instanceof Cookware) {
				let item: Cookware = block
				stepStr += ` *${item.name}* `
			}
		}
		return stepStr
	}

	renderIngredient(ingr: Ingredient) {
		let ingrStr = `${ingr.amount}${ingr.units} ${ingr.name}`;
		return ingrStr
	}

	renderCookware(ingr: Ingredient) {
		let ingrStr = `${ingr.name}`;
		return ingrStr
	}

	/** Render simple fields compactly, removing wrapping content like paragraph and span. */
	// copied from https://github.com/blacksmithgu/obsidian-dataview/blob/2301f9dcd19f662eccc4289eb2944b077ae8b3be/src/ui/render.ts#L22
	async renderCompactMarkdown(
		markdown: string,
		container: HTMLElement,
		sourcePath: string,
		component: Component
	) {
		let subcontainer = container.createSpan();
		await MarkdownRenderer.renderMarkdown(markdown, subcontainer, sourcePath, component);

		let paragraph = subcontainer.querySelector("p");
		if (subcontainer.children.length == 1 && paragraph) {
			while (paragraph.firstChild) {
				subcontainer.appendChild(paragraph.firstChild);
			}
			subcontainer.removeChild(paragraph);
		}
	}

}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
