/* globals document */

lockdown();
{
  const { quote: q } = assert;

  const $ = selector => document.querySelector(selector);

  const execute = $('#execute');
  const clear = $('#clear');
  const input = $('#input');
  const output = $('#output');

  // Under the default `lockdown` settings, it is safe enough
  // to endow with the safe `console`.
  const compartment = new Compartment({ console });

  execute.addEventListener('click', () => {
    const sourceText = input.value;
    let result;
    let outputText;
    try {
      result = compartment.evaluate(sourceText);
      outputText = `${q(result, '  ')}`;
    } catch (e) {
      outputText = `threw ${q(e)}`;
    }

    console.log(result);
    output.value = outputText;
  });

  clear.addEventListener('click', () => {
    input.value = '';
    output.value = '';
  });
}
