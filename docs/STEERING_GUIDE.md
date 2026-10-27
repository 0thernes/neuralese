# NEURALESE for beginners: how the steering and weight hacking works

This guide is for people who are curious but not into machine learning. You need no maths, and nothing you do can break the original model.

Live app: https://0thernes.github.io/neuralese/

---

## 1. What is a "tiny language model"?

A language model is a program that reads some text and guesses the next word. To be exact, it guesses the next *token*, which is a word or a piece of a word. It writes a story by guessing one token, adding it to the text, and guessing again. NEURALESE runs **TinyStories-8M**, a very small model (about 8 million numbers, called *weights*) that was trained only on simple children's stories. Big chatbots work the same way, but they are thousands of times larger. The small size is the point here: the whole model fits in your browser, so you can look inside it and change it while it runs. The weights (about 80 MB) are downloaded once from Hugging Face, and everything after that runs on your own computer.

## 2. The parts you can see (the 3D view)

Open the **3D** tab (in the **VIEW** group). The legend there says: *"Slabs = layers. Spheres = heads. Grid of points = 1024 MLP neurons. Teal tube = residual stream."* Here is what each one is:

| What you see | Its name | What it is |
|---|---|---|
| A flat **slab** | **layer** | One processing step. The model has 8 of them, stacked. Your text passes through layer 0, then layer 1, and so on up to layer 7. |
| A **sphere** on a slab | **attention head** | A part that looks back at earlier tokens and decides which ones matter right now (for example "who is *she*?"). There are 16 per layer. A bigger or brighter sphere means that head is more active on the last token. |
| The **grid of points** | **MLP neurons** | 1024 small units per layer that each react to certain patterns and push the guess toward certain words. Red means firing positive, blue means negative. |
| The **teal tube** | **residual stream** | The model's running "notepad". Each layer reads it and writes something back. A thicker tube means bigger numbers on the notepad. |

**Clicking** a sphere, a grid point or a slab only *selects* it. It changes nothing. The selection shows up everywhere: the **INSPECTOR** panel shows its weight sizes ("now" next to "orig"), and the editing panels are pre-filled with it. For a neuron, the inspector also lists the words it pushes toward and away from ("w_out·W_U top tokens"). So clicking is safe. Edits only happen when you press an **apply**, **add** or **build** button.

## 3. What does "steering" mean here?

There are two different ways to change the model's behaviour:

1. **Steering (STEER tab)**: you leave the weights alone and nudge the residual stream (the notepad) while the model is writing. You give pairs of sentences that differ in one way, for example *happy* vs *sad*. The app runs both through the original model and takes the average difference between their notepads. That difference is a direction, called a **control vector**. During generation it adds `coef × that direction` to the notepad at the chosen layers. A positive coef pushes toward the first side of each pair ("happy"), a negative coef pushes toward the second ("sad"), and a large one pushes so hard that the text falls apart.
2. **Weight hacking (SURGERY tab, and others)**: you change the stored numbers themselves, for example by zeroing one head, scaling a neuron, rounding a matrix to 2 bits, or adding noise everywhere ("chaos").

Both kinds are tracked, undoable and shown side by side with the untouched model.

## 4. A 5-minute walkthrough

1. **Open the app** and wait for the "loading…" screen to finish. If the download fails, there is a **retry** button.
2. **Generate.** In the **GEN** tab (RUN group), keep the default prompt *"Once upon a time, there was a little girl named Lily. She loved to"* and press **▶ generate** (or Ctrl/⌘+Enter). The output panel labelled **HACKED** shows the current model. With **compare clean** ticked, the faint text is the untouched model. Right now they match, because you have not changed anything.
3. **Build a steering vector.** Go to the **STEER** tab. The box already holds four happy | sad sentence pairs, and the name is `joy`. Leave the other settings at their defaults (site `resid_post`, schedule `band` centred on layer 3, coef `4`) and press **+ build & add**. A row named `joy` appears under **stack**. It has an on/off checkbox, a **coef** box and an **✕** to delete it.
4. **See the effect.** Because **auto-regen on edit** is on (GEN tab), the story regenerates by itself. Compare the HACKED text with the clean text. It should lean toward the "happy" side.
5. **Flip it.** In the `joy` row, change **coef** to `-0.5`, then to `-8`. These are the values the app's own 🧭 guide suggests. At −0.5 you get a gentle drift toward the "sad" side. At −8 the text collapses.
6. **See it.** Open the **readout** dropdown above the output and pick `proj: joy`. Each token is now coloured by how strongly it points along the joy direction.
7. **Undo.** Press **↶** in the top bar (or Ctrl/⌘+Z) until the stack is empty, or untick the row's checkbox, or press ✕.

Tip: the **🧭 guide** button in the top bar runs a 10-stop tour (generate, look inside, attention, embeddings, steer, causal tests, edit weights, measure the edit, 3D, other models).

## 5. Small experiments to try

The model samples with some randomness, but the **seed** box (GEN tab, default 42) makes runs repeatable. The same seed and settings give the same text. For a cleaner comparison, set **mode** to `greedy`. Results vary by prompt, so treat the "expect" lines as typical results, not guarantees.

**A. Your own steering vector.** In STEER, replace the pairs with your own, one pair per line in the form `positive sentence | negative sentence`. For example, sentences about a dog vs the same sentences about a cat. Name it `dog`, build it, and try coef 2, 4 and 8. *Expect:* small values tilt the topic, and large ones make the text repetitive or broken.

**B. Turn up a head's temperature, or switch it off.** Click a sphere in 3D, or go to the **RUNTIME** tab (INTERVENE group). Under *"heads of layer … temperature (logits ÷ τ) & ablation"* each head has a temperature box and an ablation menu. Set a few heads in layer 0 or 1 to zero ablation. *Expect:* removing one head usually changes little, because the model has many backups. Removing several early heads can garble the grammar.

**C. Crush a layer's precision.** In **SURGERY**, use *quantization* with `int2`, layers `3`, mats `q,k`, then press **quantize**. Then open the **IMPACT** tab (EVALUATE group) to measure how far the output moved. *Expect:* some measurable drift, and then **Ctrl+Z** restores the weights exactly, bit for bit.

**D. Chaos.** In SURGERY, set the *chaos* slider to 20% and press **inject gaussian noise everywhere**. *Expect:* the story turns to nonsense quickly. That shows how finely tuned the weights are. Undo afterwards.

Bonus without any edits: in GEN, raise **temp** (sampling temperature, default 0.7) to 1.5 and the writing gets wilder. Lower it to 0.2 and it gets safe and repetitive. This changes only how the next token is *picked*, not the model.

## 6. How to undo and reset

- **↶ / ↷** in the top bar, or **Ctrl/⌘+Z** and **Ctrl/⌘+Shift+Z**, undo and redo one step.
- The **OPS** tab (INTERVENE group) has the full **history**. Click any entry to jump back to it, or press **reset everything**, which clears all weight edits *and* runtime changes such as steering, head settings and the layer program.
- Steering vectors can also be switched off with their checkbox or removed with ✕. The RUNTIME tab has its own **reset program**.
- Reloading the page always gives you the original model. Edits are replayed on top of the original weights and never stored over them.

## 7. Saving and sharing

- **SHARE** tab (TOOLS group): **make link** produces a URL whose `#x=…` part holds your edits, steering, prompt and open tab. Anyone who opens it gets the same experiment replayed on the original weights.
- STEER → **export JSON** / **import** saves and loads steering vectors.
- ANALYZE → **download modified model.safetensors** exports the edited weights. Steering and other runtime tricks are not weights, so they are not included in that file.

## 8. FAQ

**Am I breaking anything?** No. Everything runs in your browser on your own copy. The original model on Hugging Face is never touched, and undo, reset or a reload brings back the exact original.

**Why does the output turn into gibberish?** The model only works while the numbers on its notepad stay in the range it saw during training. A big steering coef, heavy noise or aggressive quantization pushes them far outside that range, so the later layers get input they never learned to read. They then produce repeated words, random tokens or blank output. That collapse is expected, and finding the point where it starts is part of the experiment.

**Why does my steering do nothing?** The coef may be too small, the vector may be unticked, or **auto-regen on edit** may be off (press ▶ generate). The two sides of your pairs may also differ in more than one way, which gives a muddy direction.

**Why is the story so simple?** The model was trained only on children's stories, and it is tiny. Things that work here may not carry over to big models.

**Is it slow?** Everything runs on your CPU. The first load downloads about 80 MB of weights.

## 9. Mini glossary

- **Token**: a word or word-piece the model reads and writes.
- **Weights**: the stored numbers that make up the model. Training set them, and "weight hacking" changes them.
- **Layer**: one of 8 stacked processing steps.
- **Attention head**: a part of a layer that decides which earlier tokens to look at.
- **Neuron (MLP neuron)**: a small unit that fires on certain patterns and pushes toward certain words.
- **Residual stream**: the running vector ("notepad") that every layer reads from and adds to.
- **Control vector / steering vector**: a direction on that notepad, taken from contrasting sentence pairs, that gets added during generation.
- **coef**: how hard the steering vector pushes. The sign picks the side.
- **Ablation**: switching a part off (zeroing it, or replacing it with an average).
- **Temperature**: how random the next-token pick is. Higher means wilder.
- **Seed**: a number that makes the randomness repeatable.
- **Quantization**: storing numbers with fewer bits, which makes them coarser.
- **Clean vs hacked**: the untouched model vs the model with your changes.

For the full reference, see the in-app learning center (TOOLS → learn), [BIBLE.md](BIBLE.md), [GLOSSARY.md](GLOSSARY.md) and [COURSE.md](COURSE.md).
